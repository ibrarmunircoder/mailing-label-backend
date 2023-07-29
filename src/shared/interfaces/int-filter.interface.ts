import {
  EqualToFilterInterface,
  LessThanEqualFilterInterface,
  LessThanFilterInterface,
  MoreThanEqualFilterInterface,
  MoreThanFilterInterface,
  NotEqualToFilterInterface,
  ValueInFilterInterface,
  ValueNotInFilterInterface,
} from 'src/shared/interfaces';

export interface IntFilterInterface
  extends EqualToFilterInterface<number>,
    NotEqualToFilterInterface<number>,
    ValueInFilterInterface<number>,
    ValueNotInFilterInterface<number>,
    LessThanFilterInterface<number>,
    MoreThanFilterInterface<number>,
    MoreThanEqualFilterInterface<number>,
    LessThanEqualFilterInterface<number> {}
