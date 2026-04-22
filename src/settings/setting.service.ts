import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private repo: Repository<Setting>,
  ) {}

  // 🔹 GET VALUE BY KEY
  async get(key: string): Promise<string> {
    const setting = await this.repo.findOne({ where: { key } });

    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }

    return setting.value;
  }

  // 🔹 GET NUMBER VALUE (for VAT etc)
  async getNumber(key: string): Promise<number> {
    const value = await this.get(key);
    return Number(value);
  }

  // 🔹 CREATE / UPDATE (UPSERT)
  async set(key: string, value: string) {
    let setting = await this.repo.findOne({ where: { key } });

    if (!setting) {
      setting = this.repo.create({ key, value });
    } else {
      setting.value = value;
    }

    return this.repo.save(setting);
  }

  // 🔹 GET ALL SETTINGS
  async getAll() {
    return this.repo.find();
  }
}