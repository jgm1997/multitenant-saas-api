import { CreateProjectDto } from './create-project.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
