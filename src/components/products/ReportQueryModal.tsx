import { OptionPillMenuItem } from "@/components/filters/OptionPillMenu";
import { ReportModal } from "@/components/ui/ReportModal";
import { ProductQueryReportType } from "@barter/types";


const QUERY_REPORT_OPTIONS: OptionPillMenuItem[] = [
  { key: "ABUSIVE_CONTENT", value: "ABUSIVE_CONTENT", label: "Abusive Content" },
  { key: "SPAM_SCAM", value: "SPAM_SCAM", label: "Spam or Scam" },
  { key: "INAPPROPRIATE", value: "INAPPROPRIATE", label: "Inappropriate" },
  { key: "MISLEADING_QUESTION", value: "MISLEADING_QUESTION", label: "Misleading Question" },
  { key: "OFFENSIVE_LANGUAGE", value: "OFFENSIVE_LANGUAGE", label: "Offensive Language" },
  { key: "OTHER", value: "OTHER", label: "Other" },
];

interface ReportQueryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    reportType: ProductQueryReportType;
    reason?: string;
    description?: string;
  }) => void;
  isSubmitting?: boolean;
}

export function ReportQueryModal(props: ReportQueryModalProps) {
  return (
    <ReportModal<ProductQueryReportType>
      {...props}
      title="Report Question"
      subtitle="Why are you reporting this question?"
      options={QUERY_REPORT_OPTIONS}
    />
  );
}