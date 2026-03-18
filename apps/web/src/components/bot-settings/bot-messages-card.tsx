"use client";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskMessageEditor, TimerMessageEditor } from "@/components/bot-settings/message-editor";

interface BotMessagesCardProps {
  taskMessages: TaskMessagesConfig;
  timerMessages: TimerMessagesConfig;
  onTaskChange: (messages: TaskMessagesConfig) => void;
  onTimerChange: (messages: TimerMessagesConfig) => void;
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
}

export function BotMessagesCard({
  taskMessages,
  timerMessages,
  onTaskChange,
  onTimerChange,
  taskCommandsEnabled,
  timerCommandsEnabled,
}: BotMessagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bot Messages</CardTitle>
        <CardDescription>Customize chat responses for commands</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="task">
          <TabsList className="mb-4">
            <TabsTrigger value="task">Task Messages</TabsTrigger>
            <TabsTrigger value="timer">Timer Messages</TabsTrigger>
          </TabsList>
          <TabsContent value="task">
            <TaskMessageEditor
              messages={taskMessages}
              onChange={onTaskChange}
              disabled={!taskCommandsEnabled}
            />
          </TabsContent>
          <TabsContent value="timer">
            <TimerMessageEditor
              messages={timerMessages}
              onChange={onTimerChange}
              disabled={!timerCommandsEnabled}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
