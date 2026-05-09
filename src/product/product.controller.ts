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
  Query,
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

  // ================= IMAGE UPLOAD =================

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
      imageUrl: `${process.env.BASE_URL}/uploads/${file.filename}`,
    };
  }

  // ================= ADMIN GLOBAL =================

  @Post('global')
  @Roles('admin')
  createGlobal(@Body() body) {
    return this.service.createGlobal(body);
  }

  // ✅ ADMIN SEE ALL PRODUCTS
  @Get('admin/all')
  @Roles('admin')
  getAllProducts(@Query() query: any) {
    return this.service.getAllProducts(query);
  }

  // ✅ POPULAR PRODUCTS
  @Get('admin/popular')
  @Roles('admin')
  getPopularProducts(@Query('limit') limit: number) {
    return this.service.getPopularProducts(limit);
  }

  @Get('global')
  @Roles('admin', 'user')
  getGlobal(@Query() query: any) {
    return this.service.getGlobal(query);
  }

  @Put('global/:id')
  @Roles('admin')
  updateGlobal(@Param('id') id: number, @Body() body) {
    return this.service.updateGlobal(Number(id), body);
  }

  @Delete('global/:id')
  @Roles('admin')
  deleteGlobal(@Param('id') id: number) {
    return this.service.deleteGlobal(Number(id));
  }

  @Post('admin/add-popular-to-global')
  @Roles('admin')
  addPopularToGlobal(@Body('name') name: string) {
    return this.service.addPopularToGlobal(name);
  }

  // ================= USER LOCAL =================

  @Post()
  @Roles('user')
  createUser(@Body() body, @Req() req) {
    return this.service.createUserProduct(body, req.user);
  }

  @Get()
  @Roles('user')
  getUser(@Req() req, @Query() query: any) {
    return this.service.getUserProducts(req.user, query);
  }

  @Put(':id')
  @Roles('user')
  updateUser(@Param('id') id: number, @Body() body, @Req() req) {
    return this.service.updateUserProduct(Number(id), body, req.user);
  }

  @Delete(':id')
  @Roles('user')
  deleteUser(@Param('id') id: number, @Req() req) {
    return this.service.deleteUserProduct(Number(id), req.user);
  }
}
