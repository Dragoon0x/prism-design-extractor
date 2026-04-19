export { extractFromImage, type ImagePipelineInput, type ImagePipelineResult } from './pipeline.js';
export { runImageVisionPass, type RunImageVisionInput } from './vision.js';
export { fuseImageVisionReport, type FuseImageOptions, type FusedImageExtraction } from './fusion.js';
export { preprocessImage, type PreprocessedImage } from './preprocess.js';
export {
  imageVisionReportSchema,
  type ImageVisionReport,
  paletteEntrySchema,
  typographyEntrySchema,
  spacingEntrySchema,
  radiusEntrySchema,
  shadowEntrySchema,
  gradientEntrySchema,
  componentEntrySchema,
} from './vision-schema.js';
