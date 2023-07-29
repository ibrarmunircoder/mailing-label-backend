import { AddressEntity } from 'src/addresses/entities';
import {
  IsNull,
  MigrationInterface,
  Not,
  QueryRunner,
  TableColumn,
} from 'typeorm';
import * as dayjs from 'dayjs';

export class UpdateAddressTable1687152078528 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'address',
      'deliveryDate',
      new TableColumn({
        name: 'deliveryDate',
        type: 'date',
        isNullable: true,
      }),
    );

    const addressRepository = queryRunner.manager.getRepository(AddressEntity);

    const addresses = await addressRepository.find({
      where: {
        deliveryDate: Not(IsNull()),
      },
    });

    if (addresses.length) {
      await Promise.all(
        addresses.map(async (address) => {
          Object.assign(address, {
            deliveryDate: dayjs(address.deliveryDate, 'MMM DD, YYYY').format(
              'YYYY-MM-DD',
            ),
          });
          return addressRepository.save(address);
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'address',
      'deliveryDate',
      new TableColumn({
        name: 'deliveryDate',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }
}
