import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, ref } from 'vue'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
            onChanged: { addListener: vi.fn() },
        },
    },
}))

// Mock the TabStore to control tabs state without real browser calls
const mockGetAllOpenedTabs = vi.fn().mockResolvedValue([])
const mockReset           = vi.fn().mockResolvedValue(undefined)
const mockTabsRef         = ref<unknown[]>([])

vi.mock('@/stores/TabStore', () => ({
    useTabStore: () => ({
        get tabs()  { return mockTabsRef.value },
        loading:    false,
        error:      null,
        getAllOpenedTabs: mockGetAllOpenedTabs,
        reset:           mockReset,
    }),
}))

// ── Quasar stub so the component mounts without full Quasar install ────────────
// data-testid is NOT declared as a prop so it falls into $attrs and is forwarded
// to the root <button> via v-bind="$attrs".

const QBtnStub = defineComponent({
    name: 'QBtn',
    inheritAttrs: false,
    props: ['label', 'icon', 'color', 'loading'],
    emits: ['click'],
    template: `<button
        v-bind="$attrs"
        :data-label="label"
        :data-color="color"
        :data-loading="loading"
        @click="$emit('click')"
    >{{ label }}</button>`,
})

// ── Import after mocks ─────────────────────────────────────────────────────────

import LoadResetButton from '@/components/LoadResetButton.vue'

// ── Helpers ────────────────────────────────────────────────────────────────────

function mountButton() {
    return mount(LoadResetButton, {
        global: {
            plugins: [createPinia()],
            stubs: { QBtn: QBtnStub },
        },
    })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LoadResetButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
        mockTabsRef.value = []
    })

    it('shows "Load & Mark" when no tabs are loaded', () => {
        mockTabsRef.value = []
        const wrapper = mountButton()
        const btn = wrapper.find('[data-testid="btn-load-tabs"]')
        expect(btn.exists()).toBe(true)
        expect(btn.attributes('data-label')).toBe('Load & Mark')
    })

    it('shows "Load & Mark" when tabs exist but none are marked (e.g. mock tabs)', () => {
        mockTabsRef.value = [{ id: 1, isMarked: false }, { id: 2, isMarked: false }]
        const wrapper = mountButton()
        expect(wrapper.find('[data-testid="btn-load-tabs"]').exists()).toBe(true)
    })

    it('shows "Reset" when at least one tab is marked', () => {
        mockTabsRef.value = [{ id: 1, isMarked: false }, { id: 2, isMarked: true }]
        const wrapper = mountButton()
        const btn = wrapper.find('[data-testid="btn-reset"]')
        expect(btn.exists()).toBe(true)
        expect(btn.attributes('data-label')).toBe('Reset')
    })

    it('calls getAllOpenedTabs() when clicking "Load & Mark"', async () => {
        mockTabsRef.value = []
        const wrapper = mountButton()
        await wrapper.find('[data-testid="btn-load-tabs"]').trigger('click')
        expect(mockGetAllOpenedTabs).toHaveBeenCalledOnce()
        expect(mockReset).not.toHaveBeenCalled()
    })

    it('calls reset() when clicking "Reset"', async () => {
        mockTabsRef.value = [{ id: 1, isMarked: true }]
        const wrapper = mountButton()
        await wrapper.find('[data-testid="btn-reset"]').trigger('click')
        expect(mockReset).toHaveBeenCalledOnce()
        expect(mockGetAllOpenedTabs).not.toHaveBeenCalled()
    })

    it('button changes to "Reset" after a tab becomes marked', async () => {
        mockTabsRef.value = [{ id: 1, isMarked: false }]
        const wrapper = mountButton()
        expect(wrapper.find('[data-testid="btn-load-tabs"]').exists()).toBe(true)

        mockTabsRef.value = [{ id: 1, isMarked: true }]
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[data-testid="btn-reset"]').exists()).toBe(true)
    })

    it('button changes back to "Load & Mark" after reset clears tabs', async () => {
        mockTabsRef.value = [{ id: 1, isMarked: true }]
        const wrapper = mountButton()
        expect(wrapper.find('[data-testid="btn-reset"]').exists()).toBe(true)

        mockTabsRef.value = []
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[data-testid="btn-load-tabs"]').exists()).toBe(true)
    })
})
