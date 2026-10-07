import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseService } from "./database/database.service";
import { AuthGuard } from "./common/auth.guard";
import { ProfileController } from "./modules/profile/profile.controller";
import { MoodsController } from "./modules/moods/moods.controller";
import { JournalsController } from "./modules/journals/journals.controller";
import { MemoriesController } from "./modules/memories/memories.controller";
import { ConversationsController } from "./modules/conversations/conversations.controller";
import { SelfCareController } from "./modules/selfcare/selfcare.controller";
import { ReflectionsController } from "./modules/reflections/reflections.controller";
import { GardenService } from "./modules/garden/garden.service";
import { MemoriesService } from "./modules/memories/memories.service";
import { AIOrchestratorService } from "./modules/ai/orchestrator.service";
import {
  SafetyService,
  CrisisResponseService,
} from "./modules/safety/safety.service";
import { OutputGuard } from "./ai/guards/output.guard";
import { LLM_PROVIDER } from "./ai/providers/provider";
import { MockLLMProvider } from "./ai/providers/mock.provider";
import { HttpLLMProvider } from "./ai/providers/http.provider";
import { readConfig } from "./config/env";
import { SelfCareService } from "./modules/selfcare/selfcare.service";
import { AccountController } from "./modules/account/account.controller";
import { AccountExportService } from "./modules/account/account-export.service";
import { MetricsService } from "./observability/metrics.service";
import { InsightsController } from "./modules/insights/insights.controller";
import { AskMoriService } from "./modules/insights/ask-mori.service";
import { LifeMapController } from "./modules/life-map/life-map.controller";
import { LifeMapService } from "./modules/life-map/life-map.service";
import { TimelineController } from "./modules/reflections/timeline.controller";
import { TimelineService } from "./modules/reflections/timeline.service";
import { LifePatternsService } from "./modules/insights/life-patterns.service";
import { RitualsController } from "./modules/rituals/rituals.controller";
import { FirstAidController } from "./modules/safety/first-aid.controller";
import { LettersController } from "./modules/letters/letters.controller";
import { LettersService } from "./modules/letters/letters.service";
import { PrivateConversationsController } from "./modules/conversations/private-conversations.controller";
import { SoftGoalsController } from "./modules/soft-goals/soft-goals.controller";
import { SoftGoalsService } from "./modules/soft-goals/soft-goals.service";
import { PersonalMilestonesController } from "./modules/milestones/personal-milestones.controller";
import { PersonalMilestonesService } from "./modules/milestones/personal-milestones.service";
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 90 }])],
  controllers: [
    ProfileController,
    MoodsController,
    JournalsController,
    MemoriesController,
    ConversationsController,
    SelfCareController,
    ReflectionsController,
    AccountController,
    InsightsController,
    LifeMapController,
    TimelineController,
    RitualsController,
    FirstAidController,
    LettersController,
    PrivateConversationsController,
    SoftGoalsController,
    PersonalMilestonesController,
  ],
  providers: [
    DatabaseService,
    GardenService,
    SelfCareService,
    MemoriesService,
    AIOrchestratorService,
    SafetyService,
    CrisisResponseService,
    OutputGuard,
    AccountExportService,
    MetricsService,
    AskMoriService,
    LifeMapService,
    TimelineService,
    LifePatternsService,
    LettersService,
    SoftGoalsService,
    PersonalMilestonesService,
    {
      provide: LLM_PROVIDER,
      useFactory: () => {
        const env = readConfig();
        return env.MOCK_AI === "true"
          ? new MockLLMProvider()
          : new HttpLLMProvider(env);
      },
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
