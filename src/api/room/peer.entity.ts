import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('Peer')
export class Peer {
  @Field(() => String, {
    description: 'The connection socket ID',
  })
  id!: string;

  @Field(() => String, {
    nullable: true,
  })
  userID?: string;

  @Field(() => String, {
    nullable: true,
  })
  email?: string;

  @Field(() => String)
  roomID!: string;
}
