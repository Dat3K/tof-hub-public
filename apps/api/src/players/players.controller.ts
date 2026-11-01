import {BadRequestException,Controller,Get,Header,Query} from '@nestjs/common';
import {PlayerDirectoryQuerySchema} from '@tof-hub/contracts';
import {PlayerDirectoryService} from './player-directory.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly directory:PlayerDirectoryService) {}
  @Get() @Header('Cache-Control','public, max-age=30')
  list(@Query() raw:Record<string,unknown>) {
    const query=PlayerDirectoryQuerySchema.safeParse(raw);
    if(!query.success)throw new BadRequestException('Invalid player directory query');
    return this.directory.list(query.data);
  }
}
