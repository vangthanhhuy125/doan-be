export class UpdateSystemConfigDto {
  years?: string[];
  academicYears?: string[];
  semesters?: string[];
  classBranches?: string[];

  documents?: string[];
  
  achievements?: {
    academicYear: string;
    image?: string; 
    content: string;
  }[];

  formManagers?: {
    user_id: string;
    displayName?: string;
    username?: string;
  }[];

  contact?: {
    address: string;
    email: string;
    fanpage: string;
    introduction?: string;   
    mission?: string;       
    vocation?: string;       
    structure?: string;      
    softwareIntro?: string;  
  };
}