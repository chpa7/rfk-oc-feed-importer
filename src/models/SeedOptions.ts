export interface SeedOptions {
  username: string;
  password: string;
  template: 'riggsandporter';
  productFilePath?: string;
  categoryFilePath?: string;
  prefixImageUrls: boolean;
  buyerID?: string;
  catalogID?: string;
  marketplaceID: string;
  environment: 'sandbox' | 'staging' | 'production';
}
