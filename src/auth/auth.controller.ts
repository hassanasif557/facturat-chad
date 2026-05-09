import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto/register.dto';
import { LoginDto } from './dto/login.dto/login.dto';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';

import { FileInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';

import { extname } from 'path';

import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forget-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ================= REGISTER =================
  @Post('register')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: './uploads/profile-pictures',

        filename: (req, file, cb) => {
          const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, uniqueName + extname(file.originalname));
        },
      }),
    }),
  )
  async register(
    @Body() body: RegisterDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.register(body, file);
  }

  // ================= LOGIN =================
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.phone, body.password);
  }

  // ================= VERIFY OTP =================
  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.phone, body.otp);
  }

  // ================= FORGOT PASSWORD =================
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.phone);
  }

  // ================= RESET PASSWORD =================
  @Post('reset-password')
  @UseGuards(SupabaseAuthGuard)
  async resetPassword(
    @Req() req,
    @Body() body: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(
      req.user.sub,
      body.password,
    );
  }

  // ================= REFRESH =================
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  // ================= LOGOUT =================
  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  async logout(@Req() req) {
    return this.authService.logout(req.user.sub);
  }
}