import type { ReactNode } from 'react';

import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type DetailSheetProps = React.ComponentProps<typeof Sheet> & { title: string; description?: string; children: ReactNode; footer?: ReactNode; contentClassName?: string };

export function DetailSheet({ title, description, children, footer, contentClassName, ...props }: DetailSheetProps) {
  return <Sheet {...props}><SheetContent className={contentClassName}><SheetHeader><SheetTitle>{title}</SheetTitle>{description && <SheetDescription>{description}</SheetDescription>}</SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>{footer && <SheetFooter>{footer}</SheetFooter>}</SheetContent></Sheet>;
}
