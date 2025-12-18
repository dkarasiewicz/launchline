import DataLoader from 'dataloader';

export interface NestDataLoader<K, V> {
  generateDataLoader(): DataLoader<K, V>;
}
