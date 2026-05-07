import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto/register.dto';
import { LoginDto } from './dto/login.dto/login.dto';
import { SupabaseAuthGuard } from './supabase-auth/supabase-auth.guard';
import { UploadedFile, UseInterceptors } from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';

import { extname } from 'path';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: './uploads/profile-pictures',

        filename: (req, file, cb) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);

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

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  // ✅ NEW REFRESH API
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  // ✅ LOGOUT
  @Post('logout')
  @UseGuards(SupabaseAuthGuard)
  async logout(@Req() req) {
    return this.authService.logout(req.user.sub);
  }
}
