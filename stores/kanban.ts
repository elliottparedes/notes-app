import { defineStore } from 'pinia';
import type { KanbanCard, CreateKanbanCardDto, UpdateKanbanCardDto } from '~/models/Kanban';
import { useAuthStore } from './auth';

interface KanbanState {
  cards: KanbanCard[];
  loading: boolean;
  error: string | null;
}

export const useKanbanStore = defineStore('kanban', {
  state: (): KanbanState => ({
    cards: [],
    loading: false,
    error: null,
  }),

  getters: {
    getCardsByStatus: (state) => (status: string) => {
      return state.cards.filter(card => card.status === status).sort((a, b) => a.card_order - b.card_order);
    },
    getCardById: (state) => (id: number) => {
      return state.cards.find(card => card.id === id);
    }
  },

  actions: {
    async fetchKanbanCards(folderId: number | null = null, spaceId: number | null = null) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        let url = '/api/kanban/cards';
        const params: Record<string, string | number> = {};
        if (folderId !== null) {
          params.folder_id = folderId;
        } else if (spaceId !== null) {
          params.space_id = spaceId;
        }
        
        const response = await $fetch<KanbanCard[]>(url, {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          params: params
        });
        this.cards = response;
      } catch (error: any) {
        this.error = error.data?.message || 'Failed to fetch kanban cards';
        console.error('Error fetching kanban cards:', error);
      } finally {
        this.loading = false;
      }
    },

    async createKanbanCard(cardData: CreateKanbanCardDto) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        const newCard = await $fetch<KanbanCard>('/api/kanban/cards', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: cardData,
        });

        this.cards.push(newCard);
        // Ensure reactivity with sorting (getters will handle it on access)
        
        return newCard;
      } catch (error: any) {
        this.error = error.data?.message || 'Failed to create kanban card';
        console.error('Error creating kanban card:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateKanbanCard(id: number, cardData: UpdateKanbanCardDto) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        const updatedCard = await $fetch<KanbanCard>(`/api/kanban/cards/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: cardData,
        });

        const index = this.cards.findIndex(card => card.id === id);
        if (index !== -1) {
          this.cards[index] = updatedCard;
        }
        
        return updatedCard;
      } catch (error: any) {
        this.error = error.data?.message || 'Failed to update kanban card';
        console.error('Error updating kanban card:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteKanbanCard(id: number) {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        await $fetch(`/api/kanban/cards/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        this.cards = this.cards.filter(card => card.id !== id);
      } catch (error: any) {
        this.error = error.data?.message || 'Failed to delete kanban card';
        console.error('Error deleting kanban card:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // Action to reorder cards within a column or move between columns
    async reorderKanbanCard(cardId: number, newStatus: string, newIndex: number) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // Perform optimistic update
        const oldStatus = card.status;
        const oldOrder = card.card_order;

        // Temporarily remove the card from the list
        const cardsInOldStatus = this.cards.filter(c => c.status === oldStatus && c.id !== cardId).sort((a,b) => a.card_order - b.card_order);
        const cardsInNewStatus = this.cards.filter(c => c.status === newStatus && c.id !== cardId).sort((a,b) => a.card_order - b.card_order);

        // Calculate new order within the target list
        const referenceCards = newStatus === oldStatus ? cardsInOldStatus : cardsInNewStatus;
        let newCardOrder;

        if (newIndex === 0) {
            newCardOrder = (referenceCards[0]?.card_order || 0) / 2;
        } else if (newIndex >= referenceCards.length) {
            newCardOrder = (referenceCards[referenceCards.length - 1]?.card_order || 0) + 1;
        } else {
            newCardOrder = (referenceCards[newIndex - 1].card_order + referenceCards[newIndex].card_order) / 2;
        }
        
        // If the newOrder is too close to an integer, re-normalize the list (simple approach)
        if (newCardOrder < 1 && referenceCards.length > 0) {
          newCardOrder = (referenceCards[newIndex -1]?.card_order || 0) + 0.5
        } else if (newCardOrder === 0 && referenceCards.length === 0) {
          newCardOrder = 1; // First card in empty list
        }

        // Apply optimistic updates
        card.status = newStatus;
        card.card_order = newCardOrder;

        // Recalculate order for affected lists
        this.cards = this.cards.map(c => {
          if (c.id === cardId) return card;
          return c;
        });

        // Trigger sort to reflect optimistic update immediately in getters
        // Not strictly necessary as getter handles sorting on access, but good for visual debugging.
        // The actual server response will re-sync the real order.

        try {
            await this.updateKanbanCard(cardId, { status: newStatus, card_order: newCardOrder });
        } catch (e) {
            // Revert optimistic update on error
            card.status = oldStatus;
            card.card_order = oldOrder;
            this.error = 'Failed to reorder card on server.';
            throw e;
        }
    },

    async deleteCompletedCards() {
      const cardsToDelete = this.cards.filter(card => card.status === 'completed');
      if (cardsToDelete.length === 0) return;

      const cardIds = cardsToDelete.map(card => card.id);
      
      // Optimistically remove from state
      this.cards = this.cards.filter(card => card.status !== 'completed');
      
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        await $fetch('/api/kanban/cards/bulk-delete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: { cardIds },
        });
      } catch (error: any) {
        // Revert optimistic update on error
        this.cards.push(...cardsToDelete);
        this.error = error.data?.message || 'Failed to delete completed cards';
        console.error('Error deleting completed cards:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    }
  },
});
