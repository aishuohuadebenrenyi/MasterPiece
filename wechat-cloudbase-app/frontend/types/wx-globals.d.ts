declare namespace WechatMiniprogram {
  interface GeneralCallbackResult {
    errMsg: string
  }

  interface TouchEvent {
    currentTarget: {
      dataset: Record<string, any>
    }
    detail?: any
  }

  interface CustomEvent<T = any> {
    detail: T
    currentTarget: {
      dataset: Record<string, any>
    }
  }

  interface Input {
    detail: {
      value: string
    }
    currentTarget: {
      dataset: Record<string, any>
    }
  }

  namespace Cloud {
    interface CallFunctionParam {
      name: string
      data?: Record<string, any>
    }
  }
}

declare const wx: {
  cloud: {
    init(options: { env: string; traceUser: boolean }): void
    callFunction(options: WechatMiniprogram.Cloud.CallFunctionParam): Promise<{ result?: any }>
  }
  getStorageSync(key: string): any
  setStorageSync(key: string, value: any): void
  getSystemInfoSync(): {
    windowWidth: number
    windowHeight: number
    screenHeight?: number
    safeArea?: { bottom: number }
  }
  getMenuButtonBoundingClientRect?(): {
    top: number
    bottom: number
    height: number
  }
  getAccountInfoSync?: () => any
  navigateTo(options: { url: string }): void
  redirectTo(options: { url: string }): void
  switchTab(options: { url: string }): void
  navigateBack(): void
  showToast?(options: Record<string, any>): void
  showActionSheet(options: { itemList: string[]; success?: (res: { tapIndex: number }) => void; fail?: (res: any) => void }): void
  showModal(options: { title?: string; content: string; success?: (res: { confirm: boolean; cancel: boolean }) => void; fail?: (res: any) => void }): void
  hideKeyboard(options?: { success?: () => void; fail?: () => void; complete?: () => void }): void
}

declare const App: (options: Record<string, any>) => void
declare const Page: (options: Record<string, any>) => void
declare const Component: (options: Record<string, any>) => void
declare function getCurrentPages(): Array<Record<string, any>>
