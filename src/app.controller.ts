import { Controller } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  
  // Đã xoá route @Get() mặc định để ServeStaticModule có thể hiển thị index.html của Frontend
}
