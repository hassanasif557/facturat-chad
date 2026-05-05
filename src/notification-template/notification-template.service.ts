import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NotificationTemplate } from "../notification-template/notification-template.entity";
import { Repository } from "typeorm";
import { CreateNotificationTemplateDto } from "../notification-template/create-notification-template.dto";
import { NotificationEvent } from "src/notification/notification-event.enum";

@Injectable()
export class NotificationTemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private repo: Repository<NotificationTemplate>,
  ) {}

  create(dto: CreateNotificationTemplateDto) {
    const template = this.repo.create(dto);
    return this.repo.save(template);
  }

  findAll() {
    return this.repo.find();
  }

  async update(id: number, dto: Partial<CreateNotificationTemplateDto>) {
    const template = await this.repo.findOne({ where: { id } });

    if (!template) throw new NotFoundException('Template not found');

    Object.assign(template, dto);
    return this.repo.save(template);
  }

  async delete(id: number) {
    await this.repo.delete(id);
    return { message: 'Deleted' };
  }

  async findByEvent(event: NotificationEvent) {
  return this.repo.findOne({
    where: { event },
  });
}
}