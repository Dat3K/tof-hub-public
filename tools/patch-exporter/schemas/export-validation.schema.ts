import { z } from 'zod';

export const ExportValidationCheckSchema = z.object({
  category: z.string().min(1),
  item: z.string().min(1),
  status: z.enum(['PASSED', 'MISSING', 'FAILED', 'WARNING']),
  details: z.string().optional(),
});

export type ExportValidationCheck = {
  category: string;
  item: string;
  status: 'PASSED' | 'MISSING' | 'FAILED' | 'WARNING';
  details?: string;
};

export const ExportValidationReportSchema = z.object({
  timestamp: z.string().min(1),
  mode: z.enum(['Full', 'Text', 'Pic', 'Small']),
  targetDir: z.string().min(1),
  valid: z.boolean(),
  totalChecks: z.number().int().nonnegative(),
  passedChecks: z.number().int().nonnegative(),
  missingChecks: z.number().int().nonnegative(),
  warningChecks: z.number().int().nonnegative().optional(),
  results: z.array(ExportValidationCheckSchema),
});

export type ExportValidationResultReport = {
  timestamp: string;
  mode: 'Full' | 'Text' | 'Pic' | 'Small';
  targetDir: string;
  valid: boolean;
  totalChecks: number;
  passedChecks: number;
  missingChecks: number;
  warningChecks?: number;
  results: ExportValidationCheck[];
};
