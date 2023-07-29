/* eslint-disable @typescript-eslint/no-var-requires */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AddressEntity } from 'src/addresses/entities';
import { Brackets, IsNull, Repository } from 'typeorm';
import {
  AddressCreateDto,
  AddressQueryDto,
  AddressUpdateDto,
  ShopifyShippingAddressDto,
} from 'src/addresses/dtos';
import { MailgunService, MailingLabelService } from 'src/shared/services';
import { APIFeatures } from 'src/shared/utils';
import { applicationConfig } from 'src/config/app.config';
import { ConfigType } from '@nestjs/config';
import { BrandsService } from 'src/brands/brands.service';
import { RecycleDonateEnum } from 'src/addresses/enums';
import * as XLSX from 'xlsx';
import { BrandsEntity } from 'src/brands/entities';
import { plainToClass } from 'class-transformer';
const dayjs = require('dayjs');

const countryTemplates = {
  canada: 'mailback - canada',
  'united states': 'pact',
};

const countrySentShippingLabel = {
  'united states': true,
  canada: false,
};

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(AddressEntity)
    private addressRepository: Repository<AddressEntity>,
    private mailingLabelService: MailingLabelService,
    @Inject(applicationConfig.KEY)
    private appConfig: ConfigType<typeof applicationConfig>,
    private mailgunService: MailgunService,
    private brandService: BrandsService,
  ) {}

  private sendEmail(
    data: AddressCreateDto,
    templateName: string,
    attachmentBase64?: string,
    subject?: string,
  ) {
    const { email, firstName, lastName } = data;
    const attachment = [];

    if (attachmentBase64) {
      attachment.push({
        data: Buffer.from(attachmentBase64, 'base64'),
        filename: `${firstName}-${lastName}-shipping-label.pdf`,
      });
    }

    const mailInput = {
      to: [email],
      from: this.appConfig.senderEmail,
      subject: subject || 'Your Shipping Label',
      template: templateName || 'pact',
      ...(attachment.length ? { attachment } : {}),
    };

    return this.mailgunService.send(mailInput);
  }

  public async create(payload: AddressCreateDto) {
    const { lastName } = payload;
    let brandName = lastName.split('-')[1];
    if (brandName.includes('R') || brandName.includes('D')) {
      brandName = brandName.split(' ')[0];
    }
    const brand = await this.brandService.findByName(brandName);
    if (!brand) {
      throw new NotFoundException(
        `Brand not found with this brand name ${brandName}`,
      );
    }
    const xmlLabel = await this.mailingLabelService.getMailingLabel(payload);
    const base64PDF = xmlLabel.ExternalReturnLabelResponse.ReturnLabel;
    const trackingNumber = xmlLabel.ExternalReturnLabelResponse.TrackingNumber;
    const address = this.addressRepository.create({
      ...payload,
      base64PDF,
      trackingNumber,
      brandId: brand.id,
    });
    const response = await Promise.all([
      this.addressRepository.save(address),
      this.sendEmail(payload, brand.templateName, base64PDF),
    ]);
    await this.addressRepository.update(response[0]?.id, {
      emailId: response[1].id?.replace(/<|>/g, '').trim(),
    });
    return {
      message: 'Please check your email to download your shipping label.',
    };
  }

  public async webhookCreate(payload) {
    const country = payload?.shipping_address?.country ?? '';
    let brandName = '';
    let brand = null;
    for (let i = 0; i < payload.line_items.length; i++) {
      if (!brandName && payload.line_items[i].title.includes(' x ')) {
        brandName = payload.line_items[i].title.split(' x ')[0];
      }
      brand = await this.brandService.findByName(brandName);
      if (!brand && brandName) {
        brand = await this.brandService.create({
          name: brandName,
          hostname: '',
          templateName: countryTemplates[country.toLowerCase()],
        });
      }
    }
    const shopifyShippingAddress = plainToClass(
      ShopifyShippingAddressDto,
      payload,
      {
        excludeExtraneousValues: true,
      },
    );
    const inputToCreateShippingLabel: AddressCreateDto = {
      ...shopifyShippingAddress,
      lastName: shopifyShippingAddress.lastName + '-' + brandName,
      program: 'Mailback',
      recycleDonate: null,
    };
    return this.sendWebhookShippingLabel(
      inputToCreateShippingLabel,
      brand,
      countrySentShippingLabel[country.toLowerCase()],
    );
  }

  public async sendWebhookShippingLabel(
    payload: AddressCreateDto,
    brand?: BrandsEntity,
    isLabelRequired: boolean = false,
  ) {
    let base64PDF, trackingNumber;
    if (isLabelRequired) {
      const xmlLabel = await this.mailingLabelService.getMailingLabel(payload);
      base64PDF = xmlLabel.ExternalReturnLabelResponse.ReturnLabel;
      trackingNumber = xmlLabel.ExternalReturnLabelResponse.TrackingNumber;
    }
    const address = this.addressRepository.create({
      ...payload,
      base64PDF: base64PDF || '',
      trackingNumber: trackingNumber || '',
      brandId: brand.id,
    });
    const response = await Promise.all([
      this.addressRepository.save(address),
      this.sendEmail(
        payload,
        brand.templateName,
        base64PDF,
        "Thank you from Pact's mailback collection program",
      ),
    ]);
    await this.addressRepository.update(response[0]?.id, {
      emailId: response[1].id?.replace(/<|>/g, '').trim(),
    });
    return null;
  }

  public async update(id: number, payload: Partial<AddressUpdateDto>) {
    const addressEntity = await this.addressRepository.preload({
      id,
      ...payload,
    });

    if (!addressEntity) {
      throw new NotFoundException(`Address with id ${id} not found`);
    }

    return this.addressRepository.save(addressEntity);
  }

  public async getAll(query: AddressQueryDto) {
    const searchableFields = [
      'firstName',
      'lastName',
      'city',
      'zipcode',
      'state',
      'addressLine1',
      'addressLine2',
      'trackingNumber',
      'emailStatus',
      'status',
      'brand.name',
    ];

    if (!query.search) {
      const apiFeatures = new APIFeatures<AddressEntity, AddressQueryDto>(
        this.addressRepository,
        query,
      )
        .paginate()
        .sort()
        .filter()
        .search(searchableFields);

      return apiFeatures.findAllAndCount({
        relations: ['brand'],
      });
    }
    return this.search(query, searchableFields);
  }

  public async search(query: AddressQueryDto, searchableFields: string[]) {
    const queryBuilder = this.addressRepository.createQueryBuilder('address');

    if (query.filter?.brandId) {
      queryBuilder.where('address.brandId IN (:...ids)', {
        ids: query.filter?.brandId?.valueIn || [],
      });
    }

    if (query.search && searchableFields?.length) {
      const searchTerm = query.search.trim();
      queryBuilder.andWhere(
        new Brackets((qb) => {
          for (const field of searchableFields) {
            if (field === 'brand.name') {
              qb.orWhere(`${field} ILIKE :value `, {
                value: `%${searchTerm}%`,
              });
            } else {
              qb.orWhere(`address.${field} LIKE :value `, {
                value: `%${searchTerm}%`,
              });
            }
          }
          if (
            [RecycleDonateEnum.donate].includes(searchTerm as RecycleDonateEnum)
          ) {
            qb.orWhere('address.recycleDonate IN (:...attentions)', {
              attentions: [RecycleDonateEnum.donate],
            });
          }
          if (
            [RecycleDonateEnum.recycle].includes(
              searchTerm as RecycleDonateEnum,
            )
          ) {
            qb.orWhere('address.recycleDonate IN (:...attentions)', {
              attentions: [RecycleDonateEnum.recycle],
            });
          }
        }),
      );
    }

    return queryBuilder
      .leftJoinAndSelect('address.brand', 'brand')
      .getManyAndCount();
  }

  public findById(id: number) {
    return this.addressRepository.findOne({
      where: { id },
    });
  }

  public async deleteById(id: number): Promise<number> {
    const addressEntity = await this.findById(id);

    if (!addressEntity) {
      throw new NotFoundException(`Address with id ${id} not found`);
    }
    const addressEntityId = addressEntity.id;
    await this.addressRepository.remove(addressEntity);

    return addressEntityId;
  }

  public async updateAddressDeliveryDetails() {
    const addresses = await this.addressRepository.find({
      where: [
        {
          status: 'pending',
        },
        {
          status: IsNull(),
        },
      ],
    });

    if (addresses.length) {
      const addressTrackingDetailsPromises = addresses.map(async (address) => {
        const trackingDetail =
          await this.mailingLabelService.getLabelTrackingDetails(
            address.trackingNumber,
          );
        return {
          ...trackingDetail,
          addressId: address.id,
        };
      });

      const addressTrackingDetails = await Promise.all(
        addressTrackingDetailsPromises,
      );

      if (addressTrackingDetails.length) {
        const updatedAddressesPromises = addressTrackingDetails.map(
          (trackingDetail) => {
            const date = trackingDetail.deliveryDate
              ? dayjs(trackingDetail.deliveryDate, 'MMM DD, YYYY').format(
                  'YYYY-MM-DD',
                )
              : trackingDetail.deliveryDate;
            return this.addressRepository.preload({
              id: trackingDetail.addressId,
              status: trackingDetail.status,
              deliveryDate: date || null,
            });
          },
        );
        const updatedAddresses = await Promise.all(updatedAddressesPromises);
        await Promise.all(
          updatedAddresses.map(async (address) =>
            this.addressRepository.save(address),
          ),
        );
      }
    }
  }

  public async importLabels(file: Express.Multer.File) {
    const brand = await this.brandService.findByName('N/A');
    const customHeaders = [
      'createdAt',
      'program',
      'trackingNumber',
      'carrier',
      'serviceType',
      'firstName',
      'state',
      'city',
      'addressLine1',
      'zipcode',
      'status',
      'recycleDonate',
    ];

    const workbook = XLSX.read(file.buffer, {
      type: 'array',
    });

    const mailbackSheet = workbook.Sheets['USPS Labels (mail-back)'];

    const rows = XLSX.utils.sheet_to_json(mailbackSheet, {
      raw: false,
      defval: null,
      header: customHeaders,
      range: 2,
    });

    const promises = rows.map((row: any) => {
      const address = this.addressRepository.create({
        createdAt: new Date(row.createdAt),
        email: '',
        lastName: '',
        firstName: row.firstName,
        program: row.program,
        carrier: row.carrier,
        base64PDF: '',
        trackingNumber: row.trackingNumber,
        state: row.state,
        city: row.city,
        addressLine1: row.addressLine1,
        zipcode: row.zipcode,
        status: row.status,
        recycleDonate: row.recycleDonate,
        brandId: brand.id,
      });
      return this.addressRepository.save(address);
    });

    await Promise.all(promises);
    return null;
  }
}
