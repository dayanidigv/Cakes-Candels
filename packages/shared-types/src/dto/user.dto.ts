export interface UserDTO {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  isActive: boolean;
  roles: string[];
}
