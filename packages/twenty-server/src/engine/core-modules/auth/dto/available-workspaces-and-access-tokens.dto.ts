import { Field, ObjectType } from '@nestjs/graphql';

import { AuthTokenPair } from './auth-token-pair.dto';

@ObjectType('AvailableWorkspacesAndAccessTokens')
export class AvailableWorkspacesAndAccessTokensDTO {
  @Field(() => AuthTokenPair)
  tokens: AuthTokenPair;
}
