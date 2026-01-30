export class CreateOrganizationDto {
  group_name: string;
  unitType: 'CHIDOAN' | 'TAPTHE';
  intake?: string;
  biThu?: string;
  phoBiThu?: string;
  uvbch?: string[];
  member?: { role: string; name: string }[];
}