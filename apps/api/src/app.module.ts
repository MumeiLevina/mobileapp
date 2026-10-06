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
