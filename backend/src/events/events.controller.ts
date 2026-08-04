import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { toDate, toDateOrNull } from '../common/date.util';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAllPublished() {
    // Apenas eventos publicados devem ficar visíveis publicamente.
    return this.eventsService.findAll(true);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @AdminRoute()
  create(@Body() data: CreateEventDto) {
    return this.eventsService.create({
      ...data,
      data: toDate(data.data),
      dataInicioInscricao: toDateOrNull(data.dataInicioInscricao),
      dataFimInscricao: toDateOrNull(data.dataFimInscricao),
    });
  }

  @Get('admin/all')
  @AdminRoute()
  findAll() {
    return this.eventsService.findAll(false);
  }

  @Get(':id')
  @AdminRoute()
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @AdminRoute()
  update(@Param('id') id: string, @Body() data: UpdateEventDto) {
    return this.eventsService.update(id, {
      ...data,
      data: data.data ? toDate(data.data) : undefined,
      dataInicioInscricao: toDateOrNull(data.dataInicioInscricao),
      dataFimInscricao: toDateOrNull(data.dataFimInscricao),
    });
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
