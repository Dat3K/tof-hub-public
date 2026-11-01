import {Body,Controller,Get,Param,Post,Header,Ip,Query} from '@nestjs/common';
import {BuildImportService} from './build-import.service';
import {BuildProfilesService} from './build-profiles.service';
import {SavedBuildRankingService} from './saved-build-ranking.service';
import {BuildProfileDirectoryService} from './build-profile-directory.service';

@Controller('build/import')
export class BuildController {
  constructor(private readonly importer:BuildImportService,private readonly ranking:SavedBuildRankingService) {}
  @Post('ranking') @Header('Cache-Control','no-store') rankingPositions(@Body() body:unknown){return this.ranking.imported(body);}
  @Get('public-key') publicKey(){return this.importer.getPublicKey();}
  @Post() @Header('Cache-Control','no-store') importFile(@Body() body:unknown,@Ip() ip:string){return this.importer.enqueue(body,ip);}
}
/** Saved profiles per character UID (build-profiles.service.ts); a save answers with its queue job. */
@Controller('build/profiles')
export class BuildProfilesController {
  constructor(private readonly profiles:BuildProfilesService,private readonly ranking:SavedBuildRankingService,private readonly directory:BuildProfileDirectoryService) {}
  @Get() @Header('Cache-Control','no-store') all(@Query() query:Record<string,unknown>){return this.directory.list(query);}
  @Get(':uid/:slot/ranking') @Header('Cache-Control','no-store') rankingPositions(@Param('uid') uid:string,@Param('slot') slot:string,@Query() query:Record<string,unknown>){return this.ranking.get(uid,slot,query);}
  @Get(':uid') @Header('Cache-Control','no-store') list(@Param('uid') uid:string){return this.profiles.list(uid);}
  @Get(':uid/:slot') @Header('Cache-Control','no-store') get(@Param('uid') uid:string,@Param('slot') slot:string){return this.profiles.get(uid,slot);}
  @Post() @Header('Cache-Control','no-store') save(@Body() body:unknown,@Ip() ip:string){return this.profiles.enqueue(body,ip);}
}
/** Public MMO (Warp) cards per character UID × role (build-profiles.service.ts); a save answers with its queue job. */
@Controller('build/mmo-profiles')
export class MmoBuildProfilesController {
  constructor(private readonly profiles:BuildProfilesService) {}
  @Get() @Header('Cache-Control','no-store') all(@Query() query:Record<string,unknown>){return this.profiles.mmoDirectory(query);}
  @Get(':uid') @Header('Cache-Control','no-store') list(@Param('uid') uid:string){return this.profiles.listMmo(uid);}
  @Get(':uid/:role') @Header('Cache-Control','no-store') get(@Param('uid') uid:string,@Param('role') role:string){return this.profiles.getMmo(uid,role);}
  @Post() @Header('Cache-Control','no-store') save(@Body() body:unknown,@Ip() ip:string){return this.profiles.enqueue({...(body&&typeof body==='object'?body:{}),mode:'mmo'},ip);}
}
