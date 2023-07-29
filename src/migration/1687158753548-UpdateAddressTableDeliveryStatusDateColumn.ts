import { AddressEntity } from 'src/addresses/entities';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAddressTableDeliveryStatusDateColumn1687158753548
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const addressRepository = queryRunner.manager.getRepository(AddressEntity);

    const addresses = await addressRepository.find({});

    if (addresses.length) {
      await Promise.all(
        addresses.map(async (address) => {
          address.deliveryDate = null;
          address.status = null;
          return addressRepository.save(address);
        }),
      );
    }
  }

  public async down(): Promise<void> {
    return undefined;
  }
}
