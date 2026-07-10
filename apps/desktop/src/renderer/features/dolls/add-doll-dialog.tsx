import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { unwrap } from '@/renderer/lib/ipc-query';

const amazonProductUrl = /^https?:\/\/(?:www\.)?amazon\.(?:com|co\.uk|de|es|it)\/(?:[^/]+\/)?(?:dp|gp\/product)\/[a-z0-9]{10}(?:[/?]|$)/i;

export function AddDollDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const url = String(data.get('url') ?? '').trim();
    if (!name) { setError('Укажите название куклы'); return; }
    if (url && !amazonProductUrl.test(url)) { setError('Нужна ссылка на карточку Amazon'); return; }
    setSaving(true); setError(null);
    try {
      const doll = unwrap(await window.vetka.dolls.create({
        name,
        characterName: String(data.get('characterName') ?? '').trim() || null,
        lineName: String(data.get('lineName') ?? '').trim() || null,
        generation: String(data.get('generation') ?? '').trim() || null,
        mattelSku: String(data.get('mattelSku') ?? '').trim() || null,
        upcEan: String(data.get('upcEan') ?? '').trim() || null,
        imagePath: null,
        notes: String(data.get('notes') ?? '').trim() || null,
      }));
      if (url) unwrap(await window.vetka.amazon.addListing(doll.id, url));
      await queryClient.invalidateQueries({ queryKey: ['dolls'] });
      toast.success('Кукла добавлена');
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить куклу');
    } finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><PlusIcon />Добавить куклу</Button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>Новая кукла</DialogTitle><DialogDescription>Создайте карточку по тем же полям, что видны в каталоге. Ссылка Amazon необязательна: её можно добавить сейчас или позже.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <FieldGroup>
          <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="doll-name">Название</FieldLabel><Input id="doll-name" name="name" autoFocus placeholder="Draculaura Core Refresh" /><FieldError>{error}</FieldError></Field>
          <div className="grid grid-cols-2 gap-4"><Field><FieldLabel htmlFor="character">Персонаж</FieldLabel><Input id="character" name="characterName" placeholder="Draculaura" /></Field><Field><FieldLabel htmlFor="line">Линейка</FieldLabel><Input id="line" name="lineName" placeholder="Core Refresh" /></Field></div>
          <div className="grid grid-cols-3 gap-4"><Field><FieldLabel htmlFor="generation">Поколение</FieldLabel><Input id="generation" name="generation" placeholder="G3" /></Field><Field><FieldLabel htmlFor="sku">SKU Mattel</FieldLabel><Input id="sku" name="mattelSku" placeholder="HRP64" /></Field><Field><FieldLabel htmlFor="upc">UPC/EAN</FieldLabel><Input id="upc" name="upcEan" placeholder="194735183302" /></Field></div>
          <Field><FieldLabel htmlFor="amazon-url">Ссылка Amazon <span className="font-normal text-muted-foreground">(необязательно)</span></FieldLabel><Input id="amazon-url" name="url" placeholder="https://www.amazon.com/dp/…" /></Field>
          <Field><FieldLabel htmlFor="notes">Заметка</FieldLabel><Textarea id="notes" name="notes" placeholder="Особенности коробки, релиза или закупки" /></Field>
        </FieldGroup>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button><Button type="submit" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
