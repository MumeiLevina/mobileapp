"""Strict mirror of packages/live-protocol v1. Reject unknown fields."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Mode = Literal["MOCK", "STAGING", "REAL"]
Emotion = Literal["neutral", "happy", "sad", "surprised", "confused"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Envelope(Strict):
    version: Literal[1]
    context: Literal["PUBLIC_LIVE"]
    requestId: str
    eventId: str

    @field_validator("version", mode="before")
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int:
            raise ValueError("Integer protocol version required")
        return value

    @field_validator("requestId", "eventId", "sessionId", "turnId", check_fields=False)
    @classmethod
    def uuid_string(cls, value):
        if str(UUID(value)) != value.lower():
            raise ValueError("Invalid UUID")
        return value


class Session(Envelope):
    type: Literal["session.created"]
    sessionId: str
    mode: Mode
    expiresAt: str

    @field_validator("expiresAt")
    @classmethod
    def timestamp(cls, value):
        if not value.endswith("Z"):
            raise ValueError("UTC timestamp required")
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class ViewerInput(Strict):
    type: Literal["viewer_chat"] = "viewer_chat"
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def trim(cls, value):
        if not value.strip():
            raise ValueError("Empty input")
        return value.strip()


class TurnRequest(Envelope):
    type: Literal["turn.request"]
    sessionId: str
    turnId: str
    source: Literal["simulated", "operator", "youtube"]
    input: ViewerInput


class TurnResponse(Envelope):
    type: Literal["turn.response"]
    sessionId: str
    turnId: str
    mode: Mode
    status: Literal["approved", "fallback", "cancelled"]
    text: str = Field(max_length=4000)
    emotion: Emotion
    intensity: float = Field(ge=0, le=1, allow_inf_nan=False)
    animation: Literal[
        "idle", "smile_soft", "sad_soft", "surprise_soft", "confused_soft"
    ]
    trainingEligibility: Literal["prohibited"]

    @model_validator(mode="after")
    def speech_status(self):
        if (self.status == "cancelled") != (len(self.text) == 0):
            raise ValueError("Invalid speech status")
        if self.status != "cancelled" and not self.text.strip():
            raise ValueError("Empty output")
        return self


class LiveStatus(Strict):
    version: Literal[1]
    context: Literal["PUBLIC_LIVE"]
    type: Literal["live.status"]
    mode: Mode
    reservedMicros: int = Field(ge=0)
    budgetMicros: int = Field(gt=0)
    activeTurns: int = Field(ge=0)
    retainedSessions: int = Field(ge=0)
    providerUsage: Literal["not_available"]
