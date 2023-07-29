import { IsString, IsOptional } from 'class-validator';

export class IdFilterArgType {
  @IsString()
  @IsOptional()
  equalTo?: number;

  @IsString()
  @IsOptional()
  notEqualTo?: number;

  @IsString({ each: true })
  @IsOptional()
  valueNotIn?: number[];

  @IsString({ each: true })
  @IsOptional()
  valueIn?: number[];
}
