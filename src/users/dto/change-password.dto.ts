import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu cũ' })
  @IsString()
  oldPassword!: string;

  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
  })
  newPassword!: string;

  @IsNotEmpty({ message: 'Vui lòng xác nhận mật khẩu mới' })
  @IsString()
  confirmPassword!: string;
}