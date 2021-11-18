export interface SeedOptions {
  username: string;
  password: string;
  template: 'riggsandporter';
  productFilePath: string;
  categoryFilePath: string;
  marketplaceID: string;
  environment: 'sandbox' | 'staging' | 'production';
}
