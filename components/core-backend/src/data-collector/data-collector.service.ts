import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { db } from '../auth/client';
import { datasetImages } from 'src/db/schema/dataset_images.schema';

@Injectable()
export class DataCollectorService {
  async saveRecord(params: {
    uploaderId: string;
    upperJawFile: string;
    lowerJawFile: string;
    fullMouthFile: string;
    smileFile: string;
    label: string;
    notes?: string;
    gum?: boolean | null;
    caries?: boolean | null;
    surgery?: boolean | null;
    fixed?: boolean | null;
    animated?: boolean | null;
  }) {
    try {
      const [row] = await db.insert(datasetImages).values({
        uploaderId: params.uploaderId,
        upperJawFile: params.upperJawFile,
        lowerJawFile: params.lowerJawFile,
        fullMouthFile: params.fullMouthFile,
        smileFile: params.smileFile,
        gum: params.gum ?? null,
        caries: params.caries ?? null,
        surgery: params.surgery ?? null,
        fixed: params.fixed ?? null,
        animated: params.animated ?? null,
        label: params.label,
        notes: params.notes ?? null,
      }).returning();

      return row;
    } catch (e) {
      // ممكن تضيف logging هنا للخطأ e
      throw new InternalServerErrorException('DB insert failed');
    }
  }
}
