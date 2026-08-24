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
import { TenantId } from '../common/decorators/tenant.decorator';
import { Role } from '../auth/rbac.constants';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAllPublished(@TenantId() tenantId: string) {
    // Apenas eventos publicados da organização atual ficam visíveis publicamente
    return this.eventsService.findAll(tenantId, true);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER)
  create(
    @TenantId() tenantId: string,
    @Body() data: CreateEventDto,
  ) {
    return this.eventsService.create(tenantId, {
      ...data,
      data: toDate(data.data),
      dataInicioInscricao: toDateOrNull(data.dataInicioInscricao),
      dataFimInscricao: toDateOrNull(data.dataFimInscricao),
    });
  }

  @Get('admin/all')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF, Role.VIEWER)
  findAll(@TenantId() tenantId: string) {
    return this.eventsService.findAll(tenantId, false);
  }

  @Get(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF, Role.VIEWER)
  findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER)
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: UpdateEventDto,
  ) {
    return this.eventsService.update(tenantId, id, {
      ...data,
      data: data.data ? toDate(data.data) : undefined,
      dataInicioInscricao: toDateOrNull(data.dataInicioInscricao),
      dataFimInscricao: toDateOrNull(data.dataFimInscricao),
    });
  }

  @Delete(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.remove(tenantId, id);
  }
}
