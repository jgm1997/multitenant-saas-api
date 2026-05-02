import { Injectable, NotFoundException } from '@nestjs/common';
import { getTenantContext } from 'src/common/tenant-context';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, ownerId: string) {
    const { tenantId } = getTenantContext();

    return await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        tenantId,
        ownerId,
      },
      select: this.projectSelect(),
    });
  }

  async findAll() {
    return await this.prisma.project.findMany({
      select: this.projectSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id },
      select: this.projectSelect(),
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return await this.prisma.project.update({
      where: { id },
      data: dto,
      select: this.projectSelect(),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.project.delete({ where: { id } });
    return { message: `Project ${id} deleted successfully` };
  }

  private projectSelect() {
    return {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
}
