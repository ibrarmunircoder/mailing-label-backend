import { AddressEntity } from 'src/addresses/entities';
import { BrandsEntity } from 'src/brands/entities';
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const BENEFIT_HOSTNAME_DEV = '13.50.236.225';
const BENEFIT_HOSTNAME_PROD = 'benefitform.myadminform.com';
const MANE_HOSTNAME_DEV = '13.50.236.225:2552';
const MANE_HOSTNAME_PROD = 'maneaddictsform.myadminform.com';

export class updateAddressesBrandId1683001441307 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'brand',
      new TableColumn({
        name: 'templateName',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'address',
      new TableColumn({
        name: 'emailId',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'address',
      new TableColumn({
        name: 'emailStatus',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'address',
      new TableColumn({
        name: 'emailFailedReason',
        type: 'varchar',
        isNullable: true,
      }),
    );
    const addressRepository = queryRunner.manager.getRepository(AddressEntity);
    const brandRepository = queryRunner.manager.getRepository(BrandsEntity);

    const benefit = brandRepository.create({
      name: 'Benefit',
      hostname:
        process.env.NODE_ENV === 'development'
          ? BENEFIT_HOSTNAME_DEV
          : BENEFIT_HOSTNAME_PROD,
    });
    const mane = brandRepository.create({
      name: 'Mane',
      hostname:
        process.env.NODE_ENV === 'development'
          ? MANE_HOSTNAME_DEV
          : MANE_HOSTNAME_PROD,
    });

    const benefitEntity = await brandRepository.save(benefit);
    const maneEntity = await brandRepository.save(mane);

    const addresses = await addressRepository.find({});

    const benefitAddresses = addresses.filter((address) =>
      address.lastName?.includes('Benefit'),
    );
    const maneAddresses = addresses.filter((address) =>
      address.lastName?.includes('Mane'),
    );

    const benefitAddressesUpdatePromises = benefitAddresses.map((address) =>
      addressRepository.update(address.id, { brandId: benefitEntity.id }),
    );

    await Promise.all(benefitAddressesUpdatePromises);

    const maneAddressesUpdatePromises = maneAddresses.map((address) =>
      addressRepository.update(address.id, { brandId: maneEntity.id }),
    );

    await Promise.all(maneAddressesUpdatePromises);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('brand', 'templateName');
    await queryRunner.dropColumn('address', 'emailId');
    await queryRunner.dropColumn('address', 'emailStatus');
    await queryRunner.dropColumn('address', 'emailFailedReason');
  }
}
