// Single place to read version from package.json
import packageJson from '../../package.json';

export const VERSION: string = packageJson?.version ?? '0.0.0';
