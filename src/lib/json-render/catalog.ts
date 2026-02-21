import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react"
import { z } from "zod"

export const catalog = defineCatalog(schema, {
  components: {
    Card: {
      props: z.object({ title: z.string() }),
      slots: ["default"],
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
      }),
    },
  },
  actions: {},
})
