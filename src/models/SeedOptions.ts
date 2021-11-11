export interface SeedOptions {
  username: string;
  password: string;
  template: 'riggsandporter';
  filepath: string;
  marketplaceID: string;
  environment: 'sandbox' | 'staging' | 'production';
}
