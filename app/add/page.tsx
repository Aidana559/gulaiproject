import DemoForm from "@/components/DemoForm";
import { Field, SelectField, TextArea, inputClass } from "@/components/FormField";

export const metadata = { title: "Добавить книгу — Page2Page" };

export default function AddPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-stone-900">Добавить издание</h1>
      <p className="mt-2 text-stone-500">Заполните форму — объявление появится в каталоге.</p>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <DemoForm submitLabel="Опубликовать" successMessage="Объявление сохранено (демо-режим, бэкенд пока не подключён).">
          <Field label="Название" id="title" required placeholder="Например: Мастер и Маргарита" />
          <Field label="Автор" id="author" required />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Категория" id="category">
              <option value="book">Книга</option>
              <option value="textbook">Учебник</option>
              <option value="guide">Методичка</option>
              <option value="manga">Манга</option>
            </SelectField>
            <Field label="Жанр / предмет" id="genre" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Год издания" id="year" type="number" />
            <Field label="Город" id="city" />
          </div>
          <TextArea label="Описание" id="description" />
          <div>
            <label htmlFor="cover" className="mb-1.5 block text-sm font-medium text-stone-700">Обложка</label>
            <input
              id="cover"
              name="cover"
              type="file"
              accept="image/*"
              className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100`}
            />
          </div>
        </DemoForm>
      </div>
    </div>
  );
}