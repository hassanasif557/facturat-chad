import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('products')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ProductController {
  constructor(private service: ProductService) {}

  // ===== IMAGE UPLOAD =====
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          cb(null, Date.now() + '-' + file.originalname);
        },
      }),
    }),
  )
  upload(@UploadedFile() file) {
    return {
      imageUrl: `http://localhost:3000/uploads/${file.filename}`,
    };
  }

  // ===== GLOBAL (ADMIN) =====

  @Post('global')
  @Roles('admin')
  createGlobal(@Body() body) {
    return this.service.createGlobal(body);
  }

  @Get('global')
  @Roles('admin', 'user')
  getGlobal() {
    return this.service.getGlobal();
  }

  @Put('global/:id')
  @Roles('admin')
  updateGlobal(@Param('id') id: number, @Body() body) {
    return this.service.updateGlobal(id, body);
  }

  @Delete('global/:id')
  @Roles('admin')
  deleteGlobal(@Param('id') id: number) {
    return this.service.deleteGlobal(id);
  }

  // ===== USER PERSONAL =====

  @Post()
  @Roles('user')
  createUser(@Body() body, @Req() req) {
    return this.service.createUserProduct(body, req.user);
  }

  @Get()
  @Roles('user')
  getUser(@Req() req) {
    return this.service.getUserProducts(req.user);
  }

  @Put(':id')
  @Roles('user')
  updateUser(@Param('id') id: number, @Body() body, @Req() req) {
    return this.service.updateUserProduct(id, body, req.user);
  }

  @Delete(':id')
  @Roles('user')
  deleteUser(@Param('id') id: number, @Req() req) {
    return this.service.deleteUserProduct(id, req.user);
  }
}