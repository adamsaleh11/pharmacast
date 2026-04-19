import { MessageSquareText } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { EmptyState } from "@/components/product/empty-state";
import { SectionCard } from "@/components/product/section-card";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Chat"
        description="Ask inventory questions using sanitized, aggregated drug-level context after the LLM service is implemented."
      />
      <SectionCard title="Assistant workspace" description="No Grok or LLM request is made by this scaffold.">
        <EmptyState
          icon={MessageSquareText}
          title="Chat assistant is ready for integration"
          description="Future responses will be generated through Spring Boot and the LLM service with patient-level fields excluded."
          actionLabel="Start new thread"
        />
      </SectionCard>
    </div>
  );
}
