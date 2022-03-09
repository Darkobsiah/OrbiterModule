import { sleep } from '../../util'
import { IMXHelper, Transaction } from './imx_helper'

type Filter = {
  from?: string
  to?: string
}
type TransferCallbacks = {
  onConfirmation?: (transaction: Transaction) => any
  onReceived?: (transaction: Transaction) => any
}

const IMX_LISTEN_TRANSFER_DURATION = 5 * 1000

class IMXListen {
  private chainId = 0
  private receiver: string | undefined = undefined
  private isFirstTicker = true
  private transferReceivedHashs: { [key: string]: boolean } = {}
  private transferConfirmationedHashs: { [key: string]: boolean } = {}
  private listens: {
    filter: Filter | undefined
    callbacks?: TransferCallbacks
  }[] = []

  constructor(chainId: number, receiver: string | undefined = undefined) {
    this.chainId = chainId
    this.receiver = receiver

    this.start()
  }

  start() {
    const ticker = async () => {
      const imxHelper = new IMXHelper(this.chainId)

      const imxClient = await imxHelper.getImmutableXClient()

      const transfers = await imxClient.getTransfers({
        page_size: 200,
        direction: <any>'desc',
        receiver: this.receiver,
      })

      if (!transfers.result) {
        return
      }

      for (const item of transfers.result) {
        const hash = item.transaction_id

        if (this.transferReceivedHashs[hash] !== undefined) {
          continue
        }

        // Set transferReceivedHashs[hash] = false
        this.transferReceivedHashs[hash] = false

        // Ignore first ticker
        if (this.isFirstTicker) {
          continue
        }
        item.transaction_id

        this.doTransfer(item)
      }

      this.isFirstTicker = false
    }
    ticker()

    setInterval(ticker, IMX_LISTEN_TRANSFER_DURATION)
  }

  /**
   * @param transfer
   * @param retryCount
   * @returns
   */
  async doTransfer(transfer: any, retryCount = 0) {
    const { transaction_id } = transfer
    if (!transaction_id) {
      return
    }
    const imxHelper = new IMXHelper(this.chainId)

    // When retryCount > 0, get new data
    if (retryCount > 0) {
      try {
        const imxClient = await imxHelper.getImmutableXClient()
        transfer = await imxClient.getTransfer({ id: transfer.transaction_id })
      } catch (err) {
        console.error(
          `Get imx transaction [${transaction_id}] failed: ${err.message}, retryCount: ${retryCount}`
        )

        // Out max retry count
        if (retryCount >= 10) {
          return
        }

        await sleep(10000)
        return this.doTransfer(transfer, (retryCount += 1))
      }

      if (!transfer) {
        return
      }
    }

    const transaction = imxHelper.toTransaction(transfer)

    console.warn({ transaction })

    // const isConfirmed =
    //   util.equalsIgnoreCase(transaction.txreceipt_status, 'Accepted on L2') ||
    //   util.equalsIgnoreCase(transaction.txreceipt_status, 'Accepted on L1')

    // for (const item of this.listens) {
    //   const { filter, callbacks } = item

    //   if (filter) {
    //     if (filter.from && filter.from.toUpperCase() != from.toUpperCase()) {
    //       continue
    //     }
    //     if (filter.to && filter.to.toUpperCase() != to.toUpperCase()) {
    //       continue
    //     }
    //   }

    //   if (this.transferReceivedHashs[hash] !== true) {
    //     callbacks && callbacks.onReceived && callbacks.onReceived(transaction)
    //   }

    //   if (
    //     this.transferConfirmationedHashs[transaction.hash] === undefined &&
    //     isConfirmed
    //   ) {
    //     console.warn(`Transaction [${transaction.hash}] was confirmed.`)
    //     callbacks &&
    //       callbacks.onConfirmation &&
    //       callbacks.onConfirmation(transaction)
    //   }
    // }

    // this.transferReceivedHashs[hash] = true

    // if (isConfirmed) {
    //   this.transferConfirmationedHashs[transaction.hash] = true
    // } else {
    //   await util.sleep(2000)
    //   this.getTransaction(hash)
    // }
  }

  transfer(filter: Filter, callbacks = undefined) {
    this.listens.push({ filter, callbacks })
  }
}

const factorys = {}
/**
 *
 * @param chainId
 * @param receiver
 * @returns
 */
export function factoryIMXListen(
  chainId: number,
  receiver: string | undefined = undefined
) {
  const factoryKey = `${chainId}:${receiver}`

  if (factorys[factoryKey]) {
    return factorys[factoryKey]
  } else {
    return (factorys[factoryKey] = new IMXListen(chainId, receiver))
  }
}
