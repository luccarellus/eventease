import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventsService } from './events.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAllPublished() {
    return this.eventsService.findAll(true);
  }

  @Post()
  @AdminRoute()
  create(@Body() data: CreateEventDto) {
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
  update(@Param('id') id: string, @Body() data: UpdateEventDto) {
    return this.eventsService.update(id, {
      ...data,
      data: data.data ? new Date(data.data) : undefined,
    });
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
