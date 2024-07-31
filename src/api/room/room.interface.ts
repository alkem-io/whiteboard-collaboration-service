import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Room')
export class Room {
  @Field(() => String)
  id!: string;

  @Field(() => Date)
  lastActivity?: Date;
}
