import { useState } from "react";
import {
  CREATE_LISTING_RULES,
  validateCreateListingDraft,
  type CreateListingValidationResult,
  type ProductSummary,
  type UpdateProductInput,
} from "@barter/types";
import { useRouter } from "expo-router";
import {
  toErrorMessage,
  useUpdateProductMutation,
} from "@/hooks/mutations/useUpdateProductMutation";

export function useEditListingForm(product: ProductSummary) {
  const router = useRouter();
  const updateMutation = useUpdateProductMutation(product.id);

  const [title, setTitle] = useState(() => product.title ?? "");
  const [description, setDescription] = useState(() => product.description ?? "");
  const [locationName, setLocationName] = useState(() => product.locationName ?? "");
  const [categoryId, setCategoryId] = useState(() => product.categoryId ?? "");
  const [isFree, setIsFree] = useState(() => Boolean(product.isFree));
  const [requestByMoney, setRequestByMoney] = useState(() => Boolean(product.requestByMoney));
  const [fieldErrors, setFieldErrors] = useState<CreateListingValidationResult["fieldErrors"]>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});

    const validation = validateCreateListingDraft({
      title,
      description,
      locationName,
      categoryId,
      isFree,
      requestByMoney,
      imageFileNames: [],
    });

    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = buildUpdatePayload(product, validation.normalized);
    if (Object.keys(payload).length === 0) {
      router.push(`/(app)/products/${product.id}`);
      return;
    }

    try {
      const updated = await updateMutation.mutateAsync(payload);
      router.push(`/(app)/products/${updated.id}`);
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  };

  return {
    rules: CREATE_LISTING_RULES,
    state: {
      title,
      description,
      locationName,
      categoryId,
      isFree,
      requestByMoney,
      fieldErrors,
      formError,
      isSubmitting: updateMutation.isPending,
      hasInitialized: true,
    },
    actions: {
      setTitle,
      setDescription,
      setLocationName,
      setCategoryId,
      setIsFree,
      setRequestByMoney,
      setFormError,
      submit,
      cancel: () => router.back(),
    },
  };
}

function buildUpdatePayload(
  product: ProductSummary,
  normalized: {
    title: string;
    description?: string;
    categoryId?: string;
    requestByMoney?: boolean;
    isFree?: boolean;
    locationName?: string;
  },
): UpdateProductInput {
  const nextDescription = normalized.description ?? null;
  const nextLocation = normalized.locationName ?? null;
  const nextCategoryId = normalized.categoryId ?? null;
  const payload: UpdateProductInput = {};

  if (normalized.title !== product.title) {
    payload.title = normalized.title;
  }
  if ((product.description ?? null) !== nextDescription) {
    payload.description = nextDescription;
  }
  if ((product.locationName ?? null) !== nextLocation) {
    payload.locationName = nextLocation;
  }
  if ((product.categoryId ?? null) !== nextCategoryId) {
    payload.categoryId = nextCategoryId;
  }
  if (Boolean(normalized.isFree) !== Boolean(product.isFree)) {
    payload.isFree = Boolean(normalized.isFree);
  }
  if (Boolean(normalized.requestByMoney) !== Boolean(product.requestByMoney)) {
    payload.requestByMoney = Boolean(normalized.requestByMoney);
  }

  return payload;
}
