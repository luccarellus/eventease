import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventsService } from './events.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { Prisma } from '@prisma/client';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAllPublished() {
    return this.eventsService.findAll(true);
  }

  @Post()
  @AdminRoute()
  create(@Body() data: Prisma.EventoCreateInput) {
    return this.eventsService.create({
      ...data,
      data: new Date(data.data),
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
  update(@Param('id') id: string, @Body() data: Prisma.EventoUpdateInput) {
    return this.eventsService.update(id, data);
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
