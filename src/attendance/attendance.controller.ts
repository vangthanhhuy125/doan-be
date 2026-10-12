import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto, UpdateAttendanceDto, CheckInRecordDto } from './attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  async findAll(@Query('userId') userId?: string, @Req() req?: any) {
    return this.attendanceService.findAll(userId, req);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateAttendanceDto, @Req() req: any) {
    return this.attendanceService.create(dto, req);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }

  @Post(':id/check-in')
  async checkIn(@Param('id') id: string, @Body() recordDto: CheckInRecordDto) {
    return this.attendanceService.checkIn(id, recordDto);
  }
}