import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Peer')
export class Peer {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  email!: string;
}