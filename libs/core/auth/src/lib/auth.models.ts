import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@launchline/models';

registerEnumType(UserRole, {
  name: 'UserRole',
});

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}

export class VerifyEmailOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}

@ObjectType()
export class User {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field()
  isVerified!: boolean;

  @Field(() => UserRole)
  role!: UserRole;

  @Field()
  isOnboarded!: boolean;
}
